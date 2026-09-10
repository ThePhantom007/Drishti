classdef ReduceMeanLayer1023 < nnet.layer.Layer & nnet.layer.Formattable
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
            this_cg = severity_net_epoch_10.coder.ReduceMeanLayer1023(mlInstance);
        end
        function this_ml = matlabCodegenFromRedirected(cgInstance)
            this_ml = severity_net_epoch_10.ReduceMeanLayer1023(cgInstance.Name);
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
        function this = ReduceMeanLayer1023(mlInstance)
            this.Name = mlInstance.Name;
            this.OutputNames = {'x_blocks_blocks_5_83'};
            if isstruct(mlInstance.Vars)
                names = fieldnames(mlInstance.Vars);
                for i=1:numel(names)
                    fieldname = names{i};
                    this.Vars.(fieldname) = severity_net_epoch_10.coder.ops.extractIfDlarray(mlInstance.Vars.(fieldname));
                end
            else
                this.Vars = [];
            end

            this.NumDims = mlInstance.NumDims;
        end

        function [x_blocks_blocks_5_83] = predict(this, x_blocks_blocks_5_77__)
            if isdlarray(x_blocks_blocks_5_77__)
                x_blocks_blocks_5_77_ = stripdims(x_blocks_blocks_5_77__);
            else
                x_blocks_blocks_5_77_ = x_blocks_blocks_5_77__;
            end
            x_blocks_blocks_5_77NumDims = 4;
            x_blocks_blocks_5_77 = severity_net_epoch_10.coder.ops.permuteInputVar(x_blocks_blocks_5_77_, [4 3 1 2], 4);

            [x_blocks_blocks_5_83__, x_blocks_blocks_5_83NumDims__] = ReduceMeanGraph1069(this, x_blocks_blocks_5_77, x_blocks_blocks_5_77NumDims, false);
            x_blocks_blocks_5_83_ = severity_net_epoch_10.coder.ops.permuteOutputVar(x_blocks_blocks_5_83__, [3 4 2 1], 4);

            x_blocks_blocks_5_83 = dlarray(single(x_blocks_blocks_5_83_), 'SSCB');
        end

        function [x_blocks_blocks_5_83, x_blocks_blocks_5_83NumDims1071] = ReduceMeanGraph1069(this, x_blocks_blocks_5_77, x_blocks_blocks_5_77NumDims, Training)

            % Execute the operators:
            % ReduceMean:
            dims1046 = severity_net_epoch_10.coder.ops.prepareReduceArgs(this.Vars.ReduceMeanAxes1070, coder.const(x_blocks_blocks_5_77NumDims));
            xReduced1047 = mean(x_blocks_blocks_5_77, dims1046);
            x_blocks_blocks_5_83 = xReduced1047;
            x_blocks_blocks_5_83NumDims = coder.const(x_blocks_blocks_5_77NumDims);

            % Set graph output arguments
            x_blocks_blocks_5_83NumDims1071 = coder.const(x_blocks_blocks_5_83NumDims);

        end

    end

end