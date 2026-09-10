classdef ReduceMeanLayer1022 < nnet.layer.Layer & nnet.layer.Formattable
    % A custom layer auto-generated while importing an ONNX network.
    %#codegen

    %#ok<*PROPLC>
    %#ok<*NBRAK>
    %#ok<*INUSL>
    %#ok<*VARARG>
    properties (Learnable)
    end

    properties (State)
    end

    properties
        Vars
        NumDims
    end

    methods(Static, Hidden)
        % Specify the properties of the class that will not be modified
        % after the first assignment.
        function p = matlabCodegenNontunableProperties(~)
            p = {
                % Constants, i.e., Vars, NumDims and all learnables and states
                'Vars'
                'NumDims'
                };
        end
    end


    methods(Static, Hidden)
        % Instantiate a codegenable layer instance from a MATLAB layer instance
        function this_cg = matlabCodegenToRedirected(mlInstance)
            this_cg = severity_net_epoch_07.coder.ReduceMeanLayer1022(mlInstance);
        end
        function this_ml = matlabCodegenFromRedirected(cgInstance)
            this_ml = severity_net_epoch_07.ReduceMeanLayer1022(cgInstance.Name);
            if isstruct(cgInstance.Vars)
                names = fieldnames(cgInstance.Vars);
                for i=1:numel(names)
                    fieldname = names{i};
                    this_ml.Vars.(fieldname) = dlarray(cgInstance.Vars.(fieldname));
                end
            else
                this_ml.Vars = [];
            end
            this_ml.NumDims = cgInstance.NumDims;
        end
    end

    methods
        function this = ReduceMeanLayer1022(mlInstance)
            this.Name = mlInstance.Name;
            this.OutputNames = {'x_blocks_blocks_5_68'};
            if isstruct(mlInstance.Vars)
                names = fieldnames(mlInstance.Vars);
                for i=1:numel(names)
                    fieldname = names{i};
                    this.Vars.(fieldname) = severity_net_epoch_07.coder.ops.extractIfDlarray(mlInstance.Vars.(fieldname));
                end
            else
                this.Vars = [];
            end

            this.NumDims = mlInstance.NumDims;
        end

        function [x_blocks_blocks_5_68] = predict(this, x_blocks_blocks_5_62__)
            if isdlarray(x_blocks_blocks_5_62__)
                x_blocks_blocks_5_62_ = stripdims(x_blocks_blocks_5_62__);
            else
                x_blocks_blocks_5_62_ = x_blocks_blocks_5_62__;
            end
            x_blocks_blocks_5_62NumDims = 4;
            x_blocks_blocks_5_62 = severity_net_epoch_07.coder.ops.permuteInputVar(x_blocks_blocks_5_62_, [4 3 1 2], 4);

            [x_blocks_blocks_5_68__, x_blocks_blocks_5_68NumDims__] = ReduceMeanGraph1066(this, x_blocks_blocks_5_62, x_blocks_blocks_5_62NumDims, false);
            x_blocks_blocks_5_68_ = severity_net_epoch_07.coder.ops.permuteOutputVar(x_blocks_blocks_5_68__, [3 4 2 1], 4);

            x_blocks_blocks_5_68 = dlarray(single(x_blocks_blocks_5_68_), 'SSCB');
        end

        function [x_blocks_blocks_5_68, x_blocks_blocks_5_68NumDims1068] = ReduceMeanGraph1066(this, x_blocks_blocks_5_62, x_blocks_blocks_5_62NumDims, Training)

            % Execute the operators:
            % ReduceMean:
            dims1044 = severity_net_epoch_07.coder.ops.prepareReduceArgs(this.Vars.ReduceMeanAxes1067, coder.const(x_blocks_blocks_5_62NumDims));
            xReduced1045 = mean(x_blocks_blocks_5_62, dims1044);
            x_blocks_blocks_5_68 = xReduced1045;
            x_blocks_blocks_5_68NumDims = coder.const(x_blocks_blocks_5_62NumDims);

            % Set graph output arguments
            x_blocks_blocks_5_68NumDims1068 = coder.const(x_blocks_blocks_5_68NumDims);

        end

    end

end