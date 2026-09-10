classdef ReduceMeanLayer1003 < nnet.layer.Layer & nnet.layer.Formattable
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
            this_cg = severity_net_epoch_07.coder.ReduceMeanLayer1003(mlInstance);
        end
        function this_ml = matlabCodegenFromRedirected(cgInstance)
            this_ml = severity_net_epoch_07.ReduceMeanLayer1003(cgInstance.Name);
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
        function this = ReduceMeanLayer1003(mlInstance)
            this.Name = mlInstance.Name;
            this.OutputNames = {'x_blocks_blocks_1_23'};
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

        function [x_blocks_blocks_1_23] = predict(this, x_blocks_blocks_1_17__)
            if isdlarray(x_blocks_blocks_1_17__)
                x_blocks_blocks_1_17_ = stripdims(x_blocks_blocks_1_17__);
            else
                x_blocks_blocks_1_17_ = x_blocks_blocks_1_17__;
            end
            x_blocks_blocks_1_17NumDims = 4;
            x_blocks_blocks_1_17 = severity_net_epoch_07.coder.ops.permuteInputVar(x_blocks_blocks_1_17_, [4 3 1 2], 4);

            [x_blocks_blocks_1_23__, x_blocks_blocks_1_23NumDims__] = ReduceMeanGraph1009(this, x_blocks_blocks_1_17, x_blocks_blocks_1_17NumDims, false);
            x_blocks_blocks_1_23_ = severity_net_epoch_07.coder.ops.permuteOutputVar(x_blocks_blocks_1_23__, [3 4 2 1], 4);

            x_blocks_blocks_1_23 = dlarray(single(x_blocks_blocks_1_23_), 'SSCB');
        end

        function [x_blocks_blocks_1_23, x_blocks_blocks_1_23NumDims1011] = ReduceMeanGraph1009(this, x_blocks_blocks_1_17, x_blocks_blocks_1_17NumDims, Training)

            % Execute the operators:
            % ReduceMean:
            dims1006 = severity_net_epoch_07.coder.ops.prepareReduceArgs(this.Vars.ReduceMeanAxes1010, coder.const(x_blocks_blocks_1_17NumDims));
            xReduced1007 = mean(x_blocks_blocks_1_17, dims1006);
            x_blocks_blocks_1_23 = xReduced1007;
            x_blocks_blocks_1_23NumDims = coder.const(x_blocks_blocks_1_17NumDims);

            % Set graph output arguments
            x_blocks_blocks_1_23NumDims1011 = coder.const(x_blocks_blocks_1_23NumDims);

        end

    end

end